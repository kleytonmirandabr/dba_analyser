import { AppDataSource } from '../config/database';
import { NotificationChannel } from '../entities/notification-channel.entity';
import * as https from 'https';
import * as http from 'http';

export interface NotificationPayload {
  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'info' | 'resolved';
  alertId?: string;
  alertName?: string;
  databases?: string[];
  timestamp: string;
}

export async function sendNotifications(payload: NotificationPayload) {
  const channels = await AppDataSource.getRepository(NotificationChannel).find({
    where: { isActive: true, isDeleted: false },
  });

  for (const channel of channels) {
    // Filter by severity
    if (channel.severity !== 'all' && channel.severity !== payload.severity) continue;
    // Filter by alertId
    if (channel.alertIds && channel.alertIds.length > 0 && payload.alertId && !channel.alertIds.includes(payload.alertId)) continue;

    try {
      switch (channel.type) {
        case 'telegram': await sendTelegram(channel.config, payload); break;
        case 'email': await sendEmail(channel.config, payload); break;
        case 'webhook': await sendWebhook(channel.config, payload); break;
        case 'slack': await sendSlack(channel.config, payload); break;
      }
    } catch (err: any) {
      console.error(`[Notification] Failed to send via ${channel.type} (${channel.name}): ${err.message}`);
    }
  }
}

async function sendTelegram(config: any, payload: NotificationPayload) {
  const { botToken, chatId } = config;
  if (!botToken || !chatId) return;

  const emoji = payload.severity === 'critical' ? '🔴' : payload.severity === 'warning' ? '🟡' : payload.severity === 'resolved' ? '✅' : 'ℹ️';
  const text = `${emoji} *${payload.title}*\n\n${payload.message}${payload.databases?.length ? '\n\nBancos: ' + payload.databases.join(', ') : ''}\n\n_${payload.timestamp}_`;

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  await httpPost(url, { chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: true });
}

async function sendEmail(config: any, payload: NotificationPayload) {
  // Simple email via nodemailer-like SMTP (or external service)
  // For now, log - user can integrate nodemailer
  console.log(`[Notification][Email] Would send to ${config.to?.join(', ')}: ${payload.title}`);
}

async function sendWebhook(config: any, payload: NotificationPayload) {
  const { url, headers, method } = config;
  if (!url) return;
  await httpPost(url, payload, headers, method || 'POST');
}

async function sendSlack(config: any, payload: NotificationPayload) {
  const { webhookUrl } = config;
  if (!webhookUrl) return;
  const emoji = payload.severity === 'critical' ? ':red_circle:' : payload.severity === 'warning' ? ':warning:' : ':white_check_mark:';
  await httpPost(webhookUrl, {
    text: `${emoji} *${payload.title}*\n${payload.message}`,
  });
}

function httpPost(url: string, body: any, headers?: any, method = 'POST'): Promise<void> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
    }, (res) => {
      res.resume();
      res.on('end', () => resolve());
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}
