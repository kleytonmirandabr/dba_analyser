import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Alert, AlertStatus } from './alert.entity';

@Entity('alert_history')
export class AlertHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  alertId!: string;

  @ManyToOne(() => Alert, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'alertId' })
  alert!: Alert;

  @Column({ length: 20 })
  status!: AlertStatus;

  @Column('text', { nullable: true })
  value!: string | null;

  @Column('int', { nullable: true })
  executionMs!: number | null;

  @Column('text', { nullable: true })
  message!: string | null;

  @CreateDateColumn()
  checkedAt!: Date;
}
