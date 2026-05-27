import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Alert } from '../entities/alert.entity';
import { AlertHistory } from '../entities/alert-history.entity';
import { Connection } from '../entities/connection.entity';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireFeature } from '../middleware/feature.middleware';

const router = Router();

// Generate HTML report (can be converted to PDF via browser print or puppeteer)
router.get('/alerts', authMiddleware, requireFeature('reports.export'), async (req: Request, res: Response) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const since = new Date(Date.now() - hours * 3600000);

    const alerts = await AppDataSource.getRepository(Alert).find({ where: { enabled: true } });
    const history = await AppDataSource.getRepository(AlertHistory)
      .createQueryBuilder('h')
      .where('h.checkedAt >= :since', { since })
      .orderBy('h.checkedAt', 'DESC')
      .take(500)
      .getMany();

    const connections = await AppDataSource.getRepository(Connection).find({ where: { isActive: true } });

    // Count stats
    const triggered = history.filter(h => h.status === 'triggered').length;
    const ok = history.filter(h => h.status === 'ok').length;
    const errors = history.filter(h => h.status === 'error').length;
    const total = history.length;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Relatório de Alertas - DBA Analyser</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; color: #1a1a1a; max-width: 900px; margin: 0 auto; }
    h1 { color: #1a56db; font-size: 24px; border-bottom: 2px solid #1a56db; padding-bottom: 10px; }
    h2 { color: #374151; font-size: 18px; margin-top: 30px; }
    .meta { color: #6b7280; font-size: 13px; margin-bottom: 20px; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
    .stat { border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; text-align: center; }
    .stat-value { font-size: 28px; font-weight: bold; }
    .stat-label { font-size: 11px; color: #6b7280; text-transform: uppercase; }
    .triggered { color: #dc2626; border-color: #fecaca; background: #fef2f2; }
    .ok { color: #16a34a; border-color: #bbf7d0; background: #f0fdf4; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 15px; }
    th { background: #f3f4f6; padding: 8px; text-align: left; font-weight: 600; }
    td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
    tr:hover { background: #f9fafb; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; }
    .badge-critical { background: #fee2e2; color: #dc2626; }
    .badge-warning { background: #fef3c7; color: #d97706; }
    .badge-ok { background: #dcfce7; color: #16a34a; }
    .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 11px; text-align: center; }
    @media print { body { padding: 20px; } .no-print { display: none; } }
  </style>
</head>
<body>
  <h1>📊 Relatório de Alertas</h1>
  <div class="meta">
    <p>Período: últimas ${hours} horas | Gerado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
    <p>Total de conexões monitoradas: ${connections.length} | Alertas configurados: ${alerts.length}</p>
  </div>

  <div class="stats">
    <div class="stat"><div class="stat-value">${total}</div><div class="stat-label">Total checks</div></div>
    <div class="stat ok"><div class="stat-value">${ok}</div><div class="stat-label">OK</div></div>
    <div class="stat triggered"><div class="stat-value">${triggered}</div><div class="stat-label">Disparados</div></div>
    <div class="stat"><div class="stat-value">${errors}</div><div class="stat-label">Erros</div></div>
  </div>

  <h2>Alertas Configurados</h2>
  <table>
    <thead><tr><th>Nome</th><th>Severidade</th><th>Status Atual</th><th>Intervalo</th><th>Última Verificação</th></tr></thead>
    <tbody>
      ${alerts.map(a => `<tr>
        <td>${a.name}</td>
        <td><span class="badge badge-${a.severity}">${a.severity}</span></td>
        <td><span class="badge badge-${a.currentStatus === 'ok' ? 'ok' : 'critical'}">${a.currentStatus}</span></td>
        <td>${a.intervalSeconds}s</td>
        <td>${a.lastCheckedAt ? new Date(a.lastCheckedAt).toLocaleString('pt-BR') : '-'}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <h2>Últimos Incidentes</h2>
  <table>
    <thead><tr><th>Data</th><th>Status</th><th>Mensagem</th></tr></thead>
    <tbody>
      ${history.filter(h => h.status === 'triggered').slice(0, 50).map(h => `<tr>
        <td>${new Date(h.checkedAt).toLocaleString('pt-BR')}</td>
        <td><span class="badge badge-critical">triggered</span></td>
        <td style="max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${h.message || '-'}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="footer">
    <p>DBA Analyser v2.5.0 — Relatório gerado automaticamente</p>
    <p class="no-print">💡 Use Ctrl+P para salvar como PDF</p>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Health report
router.get('/health', authMiddleware, requireFeature('reports.export'), async (req: Request, res: Response) => {
  try {
    const connections = await AppDataSource.getRepository(Connection).find({ where: { isActive: true } });
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Relatório de Saúde - DBA Analyser</title>
<style>body{font-family:sans-serif;padding:40px;max-width:900px;margin:0 auto}h1{color:#1a56db;border-bottom:2px solid #1a56db;padding-bottom:10px}table{width:100%;border-collapse:collapse;font-size:13px}th{background:#f3f4f6;padding:8px;text-align:left}td{padding:8px;border-bottom:1px solid #e5e7eb}.footer{margin-top:40px;color:#9ca3af;font-size:11px;text-align:center;border-top:1px solid #e5e7eb;padding-top:15px}</style>
</head><body>
<h1>🏥 Relatório de Saúde</h1>
<p style="color:#6b7280;font-size:13px">Gerado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
<h2>Conexões (${connections.length})</h2>
<table><thead><tr><th>Nome</th><th>Tipo</th><th>Host</th><th>Database</th><th>Status</th></tr></thead>
<tbody>${connections.map(c => `<tr><td>${c.name}</td><td>${c.dbType}</td><td>${c.host}:${c.port}</td><td>${c.databaseName}</td><td>Ativo</td></tr>`).join('')}</tbody></table>
<div class="footer">DBA Analyser v2.5.0</div>
</body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
