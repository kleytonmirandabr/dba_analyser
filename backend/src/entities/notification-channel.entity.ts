import { Entity, Column } from 'typeorm';
import { BaseAuditEntity } from './base-audit.entity';

export type NotificationType = 'telegram' | 'email' | 'webhook' | 'slack';

@Entity('notification_channels')
export class NotificationChannel extends BaseAuditEntity {
  @Column('varchar', { length: 100 })
  name!: string;

  @Column('varchar', { length: 20 })
  type!: NotificationType;

  @Column('simple-json')
  config!: {
    // Telegram: { botToken, chatId }
    // Email: { smtp: { host, port, user, pass }, to: string[] }
    // Webhook: { url, headers?, method? }
    // Slack: { webhookUrl }
    [key: string]: any;
  };

  @Column({ default: true })
  isActive!: boolean;

  @Column('simple-json', { nullable: true })
  alertIds!: string[] | null; // null = all alerts, [] = specific alert IDs

  @Column('varchar', { length: 20, default: 'all' })
  severity!: string; // 'all' | 'critical' | 'warning'
}
