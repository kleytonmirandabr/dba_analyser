import PDFDocument from 'pdfkit';
import { ReportData } from './report.service';
import { Writable } from 'stream';

export async function generateReportPDF(data: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const colors = {
      primary: '#3b82f6',
      success: '#22c55e',
      warning: '#f59e0b',
      danger: '#ef4444',
      gray: '#6b7280',
      dark: '#1f2937',
      light: '#f9fafb',
    };

    // Header
    doc.rect(0, 0, doc.page.width, 80).fill(colors.primary);
    doc.fontSize(22).fillColor('#ffffff').text('DBA Analyser', 50, 25);
    doc.fontSize(10).text('Relatório Executivo de Saúde', 50, 52);
    
    const periodFrom = new Date(data.period.from).toLocaleDateString('pt-BR');
    const periodTo = new Date(data.period.to).toLocaleDateString('pt-BR');
    doc.text(`Período: ${periodFrom} — ${periodTo}`, 350, 35, { align: 'right' });
    doc.text(`Gerado em: ${new Date(data.generatedAt).toLocaleString('pt-BR')}`, 350, 50, { align: 'right' });

    doc.moveDown(3);
    doc.fillColor(colors.dark);

    // Overall Score
    const scoreColor = data.overallScore >= 80 ? colors.success : data.overallScore >= 50 ? colors.warning : colors.danger;
    doc.fontSize(14).fillColor(colors.dark).text('Saúde Geral do Ambiente', 50, 100);
    doc.fontSize(36).fillColor(scoreColor).text(`${data.overallScore}%`, 50, 125);
    doc.fontSize(9).fillColor(colors.gray).text('Score médio de todas as conexões', 50, 165);

    // Alerts box
    doc.roundedRect(300, 100, 245, 75, 5).stroke(colors.gray);
    doc.fontSize(10).fillColor(colors.dark).text('Alertas no Período', 315, 110);
    doc.fontSize(9).fillColor(colors.gray);
    doc.text(`Total: ${data.alertsSummary.total}`, 315, 130);
    doc.fillColor(colors.danger).text(`Críticos: ${data.alertsSummary.critical}`, 315, 145);
    doc.fillColor(colors.warning).text(`Warnings: ${data.alertsSummary.warning}`, 415, 145);
    doc.fillColor(colors.success).text(`Resolvidos: ${data.alertsSummary.resolved}`, 315, 160);

    // Connections detail
    let y = 200;
    doc.fontSize(14).fillColor(colors.dark).text('Detalhamento por Conexão', 50, y);
    y += 25;

    for (const conn of data.connections) {
      if (y > 700) { doc.addPage(); y = 50; }

      const connScoreColor = conn.healthScore >= 80 ? colors.success : conn.healthScore >= 50 ? colors.warning : colors.danger;
      
      // Connection header
      doc.roundedRect(50, y, 495, 20, 3).fill(colors.light);
      doc.fontSize(10).fillColor(colors.dark).text(conn.name, 60, y + 5);
      doc.fontSize(8).fillColor(colors.gray).text(`${conn.dbType.toUpperCase()} • ${conn.databaseSize}`, 300, y + 6);
      doc.fontSize(10).fillColor(connScoreColor).text(`${conn.healthScore}%`, 500, y + 5, { align: 'right' });
      y += 28;

      // Diagnostics summary
      doc.fontSize(8).fillColor(colors.gray).text(conn.diagnosticsSummary, 60, y, { width: 480 });
      y += 15;

      // Slow queries
      if (conn.topSlowQueries.length > 0) {
        doc.fontSize(8).fillColor(colors.dark).text('Top Queries Lentas:', 60, y);
        y += 12;
        for (const sq of conn.topSlowQueries) {
          doc.fontSize(7).fillColor(colors.gray)
            .text(`• ${sq.query.slice(0, 80)}... (${sq.meanTimeMs}ms avg, ${sq.calls}x)`, 70, y, { width: 470 });
          y += 11;
        }
      }
      y += 10;
    }

    // Footer
    doc.fontSize(7).fillColor(colors.gray)
      .text('Gerado automaticamente pelo DBA Analyser • Este relatório não substitui análise profissional', 50, 760, { align: 'center' });

    doc.end();
  });
}
