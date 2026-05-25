import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { Connection } from './connection.entity';

export type ExecutionStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';

@Entity('execution_requests')
export class ExecutionRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  connectionId!: string;

  @ManyToOne(() => Connection)
  @JoinColumn({ name: 'connectionId' })
  connection!: Connection;

  @Column('uuid')
  requestedById!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requestedById' })
  requestedBy!: User;

  @Column('uuid', { nullable: true })
  approvedById!: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approvedById' })
  approvedBy!: User | null;

  @Column({ length: 20, default: 'pending' })
  status!: ExecutionStatus;

  @Column('text')
  sqlText!: string;

  @Column('text', { nullable: true })
  description!: string | null;

  @Column('text', { nullable: true })
  rollbackSql!: string | null;

  @Column('text', { nullable: true })
  executionResult!: string | null;

  @Column('int', { nullable: true })
  executionDurationMs!: number | null;

  @Column('text', { nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn()
  requestedAt!: Date;

  @Column('timestamp', { nullable: true })
  approvedAt!: Date | null;

  @Column('timestamp', { nullable: true })
  executedAt!: Date | null;
}
