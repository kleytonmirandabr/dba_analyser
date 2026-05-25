import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('health_snapshots')
@Index(['connectionId', 'collectedAt'])
export class HealthSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  connectionId!: string;

  @Column({ length: 100 })
  connectionName!: string;

  @CreateDateColumn()
  collectedAt!: Date;

  // Memory
  @Column('int', { nullable: true })
  ple!: number | null;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  memoryUsedGB!: number | null;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  memoryTargetGB!: number | null;

  // CPU
  @Column('int', { nullable: true })
  cpuSqlPercent!: number | null;

  @Column('int', { nullable: true })
  cpuTotalPercent!: number | null;

  // Connections
  @Column('int', { nullable: true })
  totalConnections!: number | null;

  @Column('int', { nullable: true })
  activeConnections!: number | null;

  // TempDB
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  tempdbUsedMB!: number | null;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  tempdbFreePct!: number | null;

  // IO
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  ioReadLatencyMs!: number | null;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  ioWriteLatencyMs!: number | null;

  // Waits
  @Column('text', { nullable: true })
  topWaitsJson!: string | null;

  // Locks & Deadlocks
  @Column('int', { nullable: true })
  lockCount!: number | null;

  @Column('int', { nullable: true })
  deadlockCount!: number | null;

  // Log
  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  logUsagePct!: number | null;

  // Long queries
  @Column('int', { nullable: true })
  longQueryCount!: number | null;

  // Score
  @Column('int', { nullable: true })
  healthScore!: number | null;

  // Diagnostics JSON
  @Column('text', { nullable: true })
  diagnosticsJson!: string | null;
}
