import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('backup_jobs')
export class BackupJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  connectionId!: string;

  @Column('varchar', { length: 20 })
  type!: 'backup' | 'restore';

  @Column('varchar', { length: 20, default: 'running' })
  status!: 'running' | 'completed' | 'failed';

  @Column('varchar', { length: 20, nullable: true })
  format!: string | null;

  @Column('varchar', { length: 500, nullable: true })
  filename!: string | null;

  @Column('bigint', { nullable: true })
  sizeBytes!: number | null;

  @Column('text', { nullable: true })
  logs!: string | null;

  @Column('text', { nullable: true })
  error!: string | null;

  @Column('varchar', { length: 255, nullable: true })
  database!: string | null;

  @Column('varchar', { length: 255, nullable: true })
  schema!: string | null;

  @CreateDateColumn()
  startedAt!: Date;

  @Column('timestamp', { nullable: true })
  completedAt!: Date | null;
}
