import * as nodemailer from 'nodemailer';

interface EmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from?: string;
}

export async function sendReportEmail(
  config: EmailConfig,
  to: string[],
  subject: string,
  htmlBody: string,
  pdfBuffer: Buffer,
  filename: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.user, pass: config.pass },
    });

    await transporter.sendMail({
      from: config.from || config.user,
      to: to.join(', '),
      subject,
      html: htmlBody,
      attachments: [{ filename, content: pdfBuffer, contentType: 'application/pdf' }],
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
