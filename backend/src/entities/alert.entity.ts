import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Connection } from './connection.entity';

export type EvaluationType = 'row_count' | 'scalar_value' | 'no_rows' | 'has_rows' | 'threshold';
export type AlertOperator = '>' | '<' | '=' | '!=' | '>=' | '<=';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertStatus = 'ok' | 'triggered' | 'error' | 'unknown';

@Entity('alerts')
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar', { length: 150 })
  name!: string;

  @Column('uuid')
  connectionId!: string;

  @ManyToOne(() => Connection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connectionId' })
  connection!: Connection;

  // Multiple connections support — if set, alert runs on all of these
  // connectionId remains as "primary" for backwards compat
  @Column('simple-json', { nullable: true, default: null })
  connectionIds!: string[] | null;

  @Column('text')
  query!: string;

  @Column('varchar', { length: 20 })
  evaluationType!: EvaluationType;

  @Column('varchar', { length: 5, nullable: true })
  operator!: AlertOperator | null;

  @Column('varchar', { length: 100, nullable: true })
  threshold!: string | null;

  @Column('int', { default: 300 })
  intervalSeconds!: number;

  @Column('varchar', { length: 20, default: 'warning' })
  severity!: AlertSeverity;

  @Column({ default: true })
  enabled!: boolean;

  @Column('varchar', { length: 20, default: 'unknown' })
  currentStatus!: AlertStatus;

  @Column('text', { nullable: true })
  lastMessage!: string | null;

  @Column('timestamp', { nullable: true })
  lastCheckedAt!: Date | null;

  @Column('timestamp', { nullable: true })
  lastTriggeredAt!: Date | null;

  @Column('simple-json', { nullable: true, default: '["ui"]' })
  notifyChannels!: string[];

  @Column('uuid', { nullable: true })
  createdById!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy!: User | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
