import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('report_schedules')
export class ReportSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 20, default: 'weekly' })
  frequency: string; // daily, weekly, monthly

  @Column({ default: 1 })
  dayOfWeek: number; // 0=Sun, 1=Mon... (for weekly)

  @Column({ default: 1 })
  dayOfMonth: number; // for monthly

  @Column({ default: 8 })
  hour: number; // UTC hour to send

  @Column('simple-array')
  recipients: string[];

  @Column({ default: 7 })
  periodDays: number;

  @Column({ default: true })
  enabled: boolean;

  @Column({ nullable: true })
  lastSentAt: Date;

  @Column({ nullable: true })
  lastError: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
